"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type WorkspaceField = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "color"
    | "url"
    | "select"
    | "number"
    | "checkbox"
    | "multiselect"
    | "people";
  required?: boolean;
  maxLength?: number;
  options?: { value: string; label: string }[];
};
export function WorkspaceFormDialog({
  title,
  description,
  initial,
  fields,
  onSave,
  onClose,
  renderField,
  renderExtra,
}: {
  title: string;
  description?: string;
  initial: Record<string, string>;
  fields: WorkspaceField[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  renderField?: (
    field: WorkspaceField,
    value: string,
    onChange: (value: string) => void,
    disabled: boolean,
  ) => ReactNode;
  renderExtra?: (values: Record<string, string>) => ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  function close() {
    if (!lock.current) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save. Please retry.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ?? "Save your changes when you are ready."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={submit}
            className="min-h-0 space-y-4 overflow-y-auto px-1"
          >
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`workspace-${field.key}`}>{field.label}</Label>
                {field.type === "people" ? (
                  renderField?.(
                    field,
                    values[field.key] ?? "",
                    (value) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: value,
                      })),
                    saving,
                  )
                ) : field.type === "checkbox" ||
                  field.type === "multiselect" ? (
                  <div className="flex flex-wrap gap-3">
                    {(field.type === "checkbox"
                      ? [{ value: "true", label: field.label }]
                      : (field.options ?? [])
                    ).map((option) => {
                      const selected =
                        field.type === "checkbox"
                          ? values[field.key] === "true"
                          : (values[field.key] ?? "")
                              .split(",")
                              .includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={saving}
                            onChange={(e) =>
                              setValues((current) => ({
                                ...current,
                                [field.key]:
                                  field.type === "checkbox"
                                    ? String(e.target.checked)
                                    : [
                                        ...new Set(
                                          (current[field.key] ?? "")
                                            .split(",")
                                            .filter(
                                              (v) => v && v !== option.value,
                                            )
                                            .concat(
                                              e.target.checked
                                                ? [option.value]
                                                : [],
                                            ),
                                        ),
                                      ].join(","),
                              }))
                            }
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={`workspace-${field.key}`}
                    value={values[field.key] ?? ""}
                    maxLength={field.maxLength}
                    required={field.required}
                    disabled={saving}
                    onChange={(e) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                ) : field.type === "select" ? (
                  <select
                    id={`workspace-${field.key}`}
                    className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                    value={values[field.key] ?? ""}
                    disabled={saving}
                    onChange={(e) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`workspace-${field.key}`}
                    type={field.type ?? "text"}
                    value={values[field.key] ?? ""}
                    required={field.required}
                    maxLength={field.maxLength}
                    autoFocus={field === fields[0]}
                    disabled={saving}
                    onChange={(e) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            {renderExtra?.(values)}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={close}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : error ? "Retry save" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ProjectConfirmDialog
        open={discard}
        title="Discard unsaved changes?"
        description="Your saved data will remain intact."
        onCancel={() => setDiscard(false)}
        onConfirm={async () => onClose()}
      />
    </>
  );
}

export function ProjectConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
      onCancel();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not complete this action.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={() => void confirm()}
          >
            {saving ? "Working…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
