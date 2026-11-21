import { useState } from 'preact/hooks';

interface Props {
  onFiles: (files: File[]) => void;
  /** Valeur de l'attribut accept, par exemple « image/*,.heic » ou « application/pdf ». */
  accept: string;
  title?: string;
  hint: string;
  multiple?: boolean;
}

/** Zone de dépôt accessible : clic, toucher, clavier ou glisser-déposer. */
export default function Dropzone({ onFiles, accept, title = 'Déposez vos fichiers ici', hint, multiple = true }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      class={`dropzone${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer?.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        data-testid="file-input"
        onChange={(e) => {
          const input = e.target as HTMLInputElement;
          if (input.files?.length) onFiles(Array.from(input.files));
          input.value = '';
        }}
      />
      <span class="dropzone-title">{title}</span>
      <span class="dropzone-hint">{hint}</span>
    </label>
  );
}
