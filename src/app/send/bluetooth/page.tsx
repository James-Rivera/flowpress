import Link from "next/link";
import Image from "next/image";

export default function BluetoothSendGuidePage() {
  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-6 sm:py-10">
      <section className="mx-auto w-full max-w-[560px] rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-[0_10px_24px_rgba(17,24,39,0.08)] sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl border border-[#E5E7EB] bg-white p-2">
            <Image src="/logo.svg" alt="CJ NET shop logo" width={64} height={64} className="h-full w-full" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">Send via Bluetooth</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">Follow these steps, then ask staff to confirm receipt.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F7F7F8] p-4">
            <h2 className="text-sm font-semibold text-[#111827]">Android (most common)</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#111827]">
              <li>Turn on Bluetooth on your phone.</li>
              <li>Open the file (or go to Files / Gallery) then tap Share.</li>
              <li>Select Bluetooth.</li>
              <li>Choose the CJ NET device (ask staff for the device name if you don’t see it).</li>
              <li>Tap Send, then wait for the staff device to accept.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-[#E53935]/25 bg-[#E53935]/10 p-4">
            <h2 className="text-sm font-semibold text-[#111827]">iPhone note</h2>
            <p className="mt-2 text-sm text-[#111827]">
              iPhone usually uses <span className="font-semibold">AirDrop</span> for file sharing. Bluetooth file transfer is
              limited on iOS.
            </p>
            <p className="mt-2 text-sm text-[#111827]">If you’re on iPhone, please use AirDrop (if available) or use Upload / Gmail.</p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#111827]">If Bluetooth is not working</h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Use one of these instead:
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <Link
                href="/upload"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#F4D400] px-4 py-3 text-base font-bold text-[#111827] transition-colors hover:bg-[#e3c400] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
              >
                Upload File
              </Link>
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D1D5DB] bg-white px-4 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2"
              >
                Back to options
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
