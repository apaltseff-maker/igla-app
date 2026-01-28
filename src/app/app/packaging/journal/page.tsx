import PackagingJournalClient from "./ui";

export default function PackagingJournalPage() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-semibold">Журнал упаковки</div>
      </div>
      <PackagingJournalClient />
    </div>
  );
}
