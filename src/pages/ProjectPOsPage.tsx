import { DocumentsWorkspace } from '../components/DocumentsWorkspace';

export function ProjectPOsPage() {
  return (
    <DocumentsWorkspace
      kind="po"
      title="Project PO's"
      subtitle="Upload Purchase Order PDFs for each project and keep notes in comments."
      docsColumnLabel="PO's"
      commentField="poComment"
    />
  );
}
