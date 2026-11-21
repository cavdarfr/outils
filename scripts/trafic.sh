#!/usr/bin/env bash
# Rapport de trafic de outils.cavdar.dev à partir des journaux HTTP de Cloudflare.
# Aucun script ni cookie côté visiteur : chiffres agrégés côté serveur (robots inclus en partie).
#
# Usage : CLOUDFLARE_ANALYTICS_TOKEN=... scripts/trafic.sh [jours]   (1 à 30, 7 par défaut)
# Jeton requis : permissions « Zone > Analytics > Read » et « Zone > Zone > Read » sur cavdar.dev.
set -euo pipefail

DAYS="${1:-7}"
HOST="outils.cavdar.dev"
ZONE_NAME="cavdar.dev"
TOKEN="${CLOUDFLARE_ANALYTICS_TOKEN:?Définir CLOUDFLARE_ANALYTICS_TOKEN}"
API="https://api.cloudflare.com/client/v4"

if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || (( DAYS < 1 || DAYS > 30 )); then
  echo "Nombre de jours entre 1 et 30." >&2
  exit 1
fi

ZONE_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$API/zones?name=$ZONE_NAME" | jq -r '.result[0].id')
SINCE=$(date -u -v-"${DAYS}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${DAYS} days" +%Y-%m-%dT%H:%M:%SZ)
UNTIL=$(date -u +%Y-%m-%dT%H:%M:%SZ)

QUERY='query ($zone: string!, $since: Time!, $until: Time!, $host: string!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      pages: httpRequestsAdaptiveGroups(
        limit: 25
        orderBy: [count_DESC]
        filter: { datetime_geq: $since, datetime_lt: $until, clientRequestHTTPHost: $host, requestSource: "eyeball", edgeResponseContentTypeName: "html", edgeResponseStatus: 200 }
      ) { count dimensions { clientRequestPath } }
      referers: httpRequestsAdaptiveGroups(
        limit: 15
        orderBy: [count_DESC]
        filter: { datetime_geq: $since, datetime_lt: $until, clientRequestHTTPHost: $host, requestSource: "eyeball", edgeResponseContentTypeName: "html", clientRefererHost_neq: $host }
      ) { count dimensions { clientRefererHost } }
      countries: httpRequestsAdaptiveGroups(
        limit: 10
        orderBy: [count_DESC]
        filter: { datetime_geq: $since, datetime_lt: $until, clientRequestHTTPHost: $host, requestSource: "eyeball", edgeResponseContentTypeName: "html" }
      ) { count dimensions { clientCountryName } }
    }
  }
}'

BODY=$(jq -n --arg q "$QUERY" --arg zone "$ZONE_ID" --arg since "$SINCE" --arg until "$UNTIL" --arg host "$HOST" \
  '{query: $q, variables: {zone: $zone, since: $since, until: $until, host: $host}}')

RESULT=$(curl -fsS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data "$BODY" "$API/graphql")

if [[ $(jq '.errors | length' <<<"$RESULT") != "0" ]]; then
  jq -r '.errors[].message' <<<"$RESULT" >&2
  exit 1
fi

echo "Trafic de $HOST sur $DAYS jours (pages HTML, robots partiellement inclus)"
echo
echo "Pages vues"
jq -r '.data.viewer.zones[0].pages[] | "\(.count)\t\(.dimensions.clientRequestPath)"' <<<"$RESULT" | column -t -s $'\t'
echo
echo "Sites d'origine"
jq -r '.data.viewer.zones[0].referers[] | "\(.count)\t\(.dimensions.clientRefererHost | if . == "" then "(direct)" else . end)"' <<<"$RESULT" | column -t -s $'\t'
echo
echo "Pays"
jq -r '.data.viewer.zones[0].countries[] | "\(.count)\t\(.dimensions.clientCountryName)"' <<<"$RESULT" | column -t -s $'\t'
