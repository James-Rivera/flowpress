import { listDoneJobs, listUploadJobs, setUploadJobStatusWithTransitions } from "@/lib/print-jobs";
import type { JobStatus, PrintJob } from "@/lib/print-job-types";

const STATUS_VALUES: JobStatus[] = ["pending", "printing", "done"];

export type QueueSnapshot = {
  activeJobs: PrintJob[];
  doneJobs: PrintJob[];
  activeJobsByPath: Map<string, PrintJob>;
  doneJobsByPath: Map<string, PrintJob>;
  pendingJobs: PrintJob[];
  pendingPositions: Map<string, number>;
  nowPrinting: PrintJob | null;
};

export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  const [activeJobs, doneJobs] = await Promise.all([listUploadJobs(), listDoneJobs()]);
  const activeJobsByPath = new Map<string, PrintJob>();
  const doneJobsByPath = new Map<string, PrintJob>();
  const pendingJobs: PrintJob[] = [];
  let nowPrinting: PrintJob | null = null;

  for (const job of activeJobs) {
    activeJobsByPath.set(job.relativePath, job);

    if (job.metadata.status === "pending") {
      pendingJobs.push(job);
    } else if (job.metadata.status === "printing" && !nowPrinting) {
      nowPrinting = job;
    }
  }

  for (const job of doneJobs) {
    doneJobsByPath.set(job.relativePath, job);
    doneJobsByPath.set(job.relativePath.replace(/^done\//, ""), job);
  }

  const pendingPositions = new Map<string, number>();
  pendingJobs.forEach((job, index) => {
    pendingPositions.set(job.relativePath, index);
  });

  return {
    activeJobs,
    doneJobs,
    activeJobsByPath,
    doneJobsByPath,
    pendingJobs,
    pendingPositions,
    nowPrinting,
  };
}

export async function hasOtherPrintingJob(currentFilename: string) {
  const snapshot = await getQueueSnapshot();

  return snapshot.activeJobs.some(
    (job) => job.metadata.status === "printing" && job.relativePath !== currentFilename
  );
}

export async function promoteNextPendingJobToPrinting() {
  const snapshot = await getQueueSnapshot();

  if (snapshot.nowPrinting) {
    return null;
  }

  for (const pendingJob of snapshot.pendingJobs) {
    const promoted = await setUploadJobStatusWithTransitions(
      pendingJob.relativePath,
      "printing",
      ["pending"]
    );

    if (promoted) {
      return pendingJob.relativePath;
    }
  }

  return null;
}

export async function setUploadJobStatus(filename: string, status: JobStatus) {
  return setUploadJobStatusWithTransitions(filename, status, STATUS_VALUES);
}
