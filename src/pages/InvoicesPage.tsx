import { DocumentsWorkspace } from '../components/DocumentsWorkspace';

export function InvoicesPage() {
  return (
    <DocumentsWorkspace
      kind="invoice"
      title="Invoices"
      subtitle="Upload invoice PDFs per project and track how much payment has been received."
      docsColumnLabel="Invoice"
      commentField="invoiceComment"
    />
  );
}
