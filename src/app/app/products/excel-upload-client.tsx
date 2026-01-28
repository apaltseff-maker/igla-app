'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExcelUploadClient() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const downloadTemplate = () => {
    window.open('/api/products/template', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Файл должен быть в формате Excel (.xlsx или .xls)');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/products/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ошибка загрузки');
        if (data.details && Array.isArray(data.details)) {
          setError(data.error + '\n' + data.details.join('\n'));
        }
        return;
      }

      setSuccess(`Успешно загружено: ${data.imported} моделей`);
      if (data.errors && data.errors.length > 0) {
        setError('Частичная загрузка. Ошибки:\n' + data.errors.join('\n'));
      }

      // Обновляем страницу через 2 секунды
      setTimeout(() => {
        router.refresh();
        setShowModal(false);
        setFile(null);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded bg-blue-600 text-white py-2 px-4 text-sm hover:bg-blue-700"
      >
        Загрузить через Excel
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h2 className="text-xl font-semibold">Загрузка моделей из Excel</h2>

            <div className="space-y-2">
              <div>
                <a
                  href="/api/products/template"
                  download
                  className="text-blue-600 underline text-sm"
                  onClick={downloadTemplate}
                >
                  Скачать шаблон Excel
                </a>
              </div>

              <label className="block">
                <span className="text-sm mb-1 block">Выберите файл Excel:</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full border rounded px-3 py-2"
                />
              </label>

              {file && (
                <div className="text-sm text-gray-600">
                  Выбран файл: {file.name}
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 whitespace-pre-line">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200">
                  {success}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFile(null);
                  setError(null);
                  setSuccess(null);
                }}
                className="px-4 py-2 border rounded text-sm"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                onClick={handleUpload}
                disabled={loading || !file}
                className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-60"
              >
                {loading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
