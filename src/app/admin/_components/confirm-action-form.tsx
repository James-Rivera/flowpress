"use client";

type ConfirmActionFormProps = {
  action: string;
  jobPath: string;
  returnTo: string;
  confirmMessage: string;
  buttonLabel: string;
  buttonClassName: string;
};

export default function ConfirmActionForm({
  action,
  jobPath,
  returnTo,
  confirmMessage,
  buttonLabel,
  buttonClassName,
}: ConfirmActionFormProps) {
  return (
    <form
      action={action}
      method="post"
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="jobPath" value={jobPath} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={buttonClassName}>
        {buttonLabel}
      </button>
    </form>
  );
}
