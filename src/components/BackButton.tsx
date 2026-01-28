'use client';

export function BackButton() {
  return (
    <button type="button" className="text-sm underline" onClick={() => history.back()}>
      Назад
    </button>
  );
}
