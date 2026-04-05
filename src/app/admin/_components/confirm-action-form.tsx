"use client";

import { useRef, useState } from "react";

type ConfirmActionFormProps = {
  action: string;
  jobPath: string;
  returnTo: string;
  confirmMessage?: string;
  hiddenFields?: Record<string, string>;
  buttonLabel: string;
  buttonClassName: string;
};

export default function ConfirmActionForm({
  action,
  jobPath,
  returnTo,
  confirmMessage,
  hiddenFields,
  buttonLabel,
  buttonClassName,
}: ConfirmActionFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const shouldBypassConfirmRef = useRef(false);

  function handleConfirm() {
    shouldBypassConfirmRef.current = true;
    setIsModalOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        method="post"
        onSubmit={(event) => {
          if (!confirmMessage) {
            return;
          }

          if (shouldBypassConfirmRef.current) {
            shouldBypassConfirmRef.current = false;
            return;
          }

          event.preventDefault();
          setIsModalOpen(true);
        }}
      >
        <input type="hidden" name="jobPath" value={jobPath} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
        <button type="submit" className={buttonClassName}>
          {buttonLabel}
        </button>
      </form>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111827]/40 px-4">
          <div className="w-full max-w-md rounded-[1.25rem] border border-[#E5E7EB] bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#111827]">Confirm Action</h3>
            <p className="mt-2 text-sm text-[#6B7280]">{confirmMessage}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="secondary-btn !px-4 !py-2 !text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="danger-btn !bg-[#E53935] !px-4 !py-2 !text-sm !text-white hover:!bg-[#cf302c]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
