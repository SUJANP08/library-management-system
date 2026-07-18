import React from "react";
import { IconAlertTriangle, IconInfo } from "./Icons";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = true, onConfirm, onCancel,
}: Props) {
  return (
    <div className="modal-overlay z-40">
      <div className="modal-panel sm:max-w-sm p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
          }`}>
            {danger ? <IconAlertTriangle className="w-5 h-5" /> : <IconInfo className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">{title}</h3>
            <p className="text-sm text-stone-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={danger ? "btn-danger flex-1" : "btn-primary flex-1"}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
