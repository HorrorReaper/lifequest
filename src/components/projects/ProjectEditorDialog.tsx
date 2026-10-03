"use client";

import {
  PROJECT_STATUSES,
  newProjectDraft,
  projectDraft,
  type ProjectArea,
  type ProjectDraft,
  type WorkspaceProject,
} from "@/lib/projects/project-workspace";
import {
  WorkspaceFormDialog,
  type WorkspaceField,
} from "./WorkspaceFormDialog";

export function ProjectEditorDialog({
  project,
  areas,
  onSave,
  onClose,
}: {
  project: WorkspaceProject | null;
  areas: ProjectArea[];
  onSave: (draft: ProjectDraft) => Promise<void>;
  onClose: () => void;
}) {
  const draft = project ? projectDraft(project) : newProjectDraft();
  const initial = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, value ?? ""]),
  );
  const fields: WorkspaceField[] = [
    { key: "name", label: "Project name", required: true, maxLength: 120 },
    {
      key: "area_id",
      label: "Area",
      type: "select",
      options: [
        { value: "", label: "Ohne Bereich" },
        ...areas.map((area) => ({ value: area.id, label: area.name })),
      ],
    },
    {
      key: "outcome",
      label: "Goal / outcome",
      type: "textarea",
      maxLength: 2000,
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      maxLength: 20000,
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: PROJECT_STATUSES.filter(
        (status) => status !== "archived" || project?.status === "archived",
      ).map((value) => ({ value, label: value })),
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: ["low", "medium", "high", "urgent"].map((value) => ({
        value,
        label: value,
      })),
    },
    {
      key: "health",
      label: "Health",
      type: "select",
      options: ["unset", "on_track", "at_risk", "off_track"].map((value) => ({
        value,
        label: value.replaceAll("_", " "),
      })),
    },
    { key: "start_date", label: "Start date", type: "date" },
    { key: "target_date", label: "Target date", type: "date" },
    { key: "color", label: "Color", type: "color" },
  ];
  return (
    <WorkspaceFormDialog
      title={project ? "Edit project" : "New project"}
      initial={initial}
      fields={fields}
      onClose={onClose}
      onSave={(values) => {
        if (
          values.start_date &&
          values.target_date &&
          values.start_date > values.target_date
        )
          throw new Error("Target date must be on or after the start date.");
        return onSave({
          ...values,
          name: values.name.trim(),
          outcome: values.outcome.trim(),
          description: values.description.trim(),
          area_id: values.area_id || null,
          start_date: values.start_date || null,
          target_date: values.target_date || null,
        } as ProjectDraft);
      }}
    />
  );
}
