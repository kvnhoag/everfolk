import { useId, useRef, useState } from "react";
import { useGameModal } from "../hooks/useGameModal.ts";
import { AUTO_MODE_CONFIRM_COPY } from "../models/auto-mode-confirm.ts";
import "../styles/auto-mode-confirm.css";

interface Props {
  open: boolean;
  lifeKey: string;
  onConfirm(dontAskAgain: boolean): void;
  onCancel(): void;
}

function OpenAutoModeConfirmDialog({ onConfirm, onCancel }: Omit<Props, "open" | "lifeKey">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepChoosing = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useGameModal(dialog, true, previousFocus => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    keepChoosing.current?.focus({ preventScroll: true });
    return () => {
      const restoreFocus = document.activeElement === document.body || element?.contains(document.activeElement);
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  });

  return <dialog ref={dialog} className="auto-mode-confirm-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={`${id}-title`}>{AUTO_MODE_CONFIRM_COPY.title}</h2>
    <p id={`${id}-body`} className="auto-mode-confirm-body">{AUTO_MODE_CONFIRM_COPY.body}</p>
    <label className="auto-mode-confirm-remember">
      <input type="checkbox" checked={dontAskAgain} onChange={event => setDontAskAgain(event.target.checked)} />
      <span>{AUTO_MODE_CONFIRM_COPY.remember}</span>
    </label>
    <div className="auto-mode-confirm-actions">
      <button ref={keepChoosing} type="button" className="secondary-button" onClick={onCancel}>{AUTO_MODE_CONFIRM_COPY.cancel}</button>
      <button type="button" className="primary-button" onClick={() => onConfirm(dontAskAgain)}>{AUTO_MODE_CONFIRM_COPY.confirm}</button>
    </div>
  </dialog>;
}

/** Confirms turning Auto mode on; closes automatically if the game screen is hidden. */
export default function AutoModeConfirmDialog({ open, lifeKey, ...props }: Props) {
  return open ? <OpenAutoModeConfirmDialog key={lifeKey} {...props} /> : null;
}
