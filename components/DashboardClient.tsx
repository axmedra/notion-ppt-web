"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { NotionDatabase, NotionPage } from "@/lib/types";

type Step = "databases" | "pages" | "template" | "exporting";

export const DashboardClient = () => {
  const [step, setStep] = useState<Step>("databases");
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<NotionDatabase | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/databases");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch databases");
      }
      setDatabases(data.databases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки баз данных");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const handleSelectDatabase = async (database: NotionDatabase) => {
    setSelectedDatabase(database);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/pages/${database.id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch pages");
      }
      setPages(data.pages);
      setSelectedPageIds(new Set());
      setStep("pages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки страниц");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePage = (pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedPageIds.size === pages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(pages.map((p) => p.id)));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith(".pptx")) {
      setTemplateFile(file);
      setError(null);
    } else {
      setError("Пожалуйста, выберите файл .pptx");
    }
  };

  const handleExport = async () => {
    if (!templateFile || selectedPageIds.size === 0) return;

    setStep("exporting");
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("template", templateFile);
      formData.append("pageIds", JSON.stringify(Array.from(selectedPageIds)));

      const response = await fetch("/api/export", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to export");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presentation.pptx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep("databases");
      setSelectedDatabase(null);
      setPages([]);
      setSelectedPageIds(new Set());
      setTemplateFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка экспорта");
      setStep("template");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".pptx")) {
      setTemplateFile(file);
      setError(null);
    } else {
      setError("Пожалуйста, выберите файл .pptx");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  if (loading && step === "databases" && databases.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка баз данных...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Шаги */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div
          className={`px-4 py-2 rounded-full ${
            step === "databases" ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          1. База данных
        </div>
        <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
        <div
          className={`px-4 py-2 rounded-full ${
            step === "pages" ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          2. Страницы
        </div>
        <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />
        <div
          className={`px-4 py-2 rounded-full ${
            step === "template" || step === "exporting"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700"
          }`}
        >
          3. Экспорт
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="py-4">
            <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Шаг 1: Выбор базы данных */}
      {step === "databases" && (
        <Card>
          <CardHeader>
            <CardTitle>Выберите базу данных</CardTitle>
            <CardDescription>
              Выберите Notion базу данных с записями для экспорта
            </CardDescription>
          </CardHeader>
          <CardContent>
            {databases.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Не найдено баз данных. Убедитесь, что вы предоставили доступ к нужным базам при авторизации.
              </p>
            ) : (
              <div className="grid gap-3">
                {databases.map((db) => (
                  <button
                    key={db.id}
                    type="button"
                    onClick={() => handleSelectDatabase(db)}
                    className="flex items-center gap-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left w-full"
                    disabled={loading}
                    aria-label={`Выбрать базу данных ${db.title}`}
                  >
                    <span className="text-2xl">{db.icon || "📊"}</span>
                    <span className="font-medium">{db.title}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Шаг 2: Выбор страниц */}
      {step === "pages" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Выберите страницы</CardTitle>
                <CardDescription>
                  База: {selectedDatabase?.icon} {selectedDatabase?.title}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep("databases")}>
                ← Назад
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Не найдено страниц с заполненным &quot;Slide type&quot;
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedPageIds.size === pages.length ? "Снять выбор" : "Выбрать все"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Выбрано: {selectedPageIds.size} из {pages.length}
                  </span>
                </div>
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {pages.map((page) => (
                    <label
                      key={page.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPageIds.has(page.id)}
                        onCheckedChange={() => handleTogglePage(page.id)}
                        aria-label={`Выбрать страницу ${page.title}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{page.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {page.slideType}
                          {page.bankNames.length > 0 && ` • ${page.bankNames.join(", ")}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={selectedPageIds.size === 0}
                  onClick={() => setStep("template")}
                >
                  Далее ({selectedPageIds.size} страниц)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Шаг 3: Загрузка шаблона и экспорт */}
      {(step === "template" || step === "exporting") && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Загрузите шаблон</CardTitle>
                <CardDescription>
                  Выбрано страниц: {selectedPageIds.size}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("pages")}
                disabled={step === "exporting"}
              >
                ← Назад
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                templateFile
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {templateFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="font-medium">{templateFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(templateFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplateFile(null)}
                    disabled={step === "exporting"}
                  >
                    Заменить файл
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Перетащите .pptx файл сюда</p>
                    <p className="text-sm text-muted-foreground">или</p>
                  </div>
                  <Label
                    htmlFor="template-upload"
                    className="inline-flex items-center px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Выберите файл
                  </Label>
                  <input
                    id="template-upload"
                    type="file"
                    accept=".pptx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Требования к шаблону:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Именованные shapes: Title, Body, BankName1</li>
                <li>• Для картинок: Image 1, Image 2, Image 3</li>
                <li>• Откройте Selection Pane (⌥+F10) для переименования</li>
              </ul>
            </div>

            <Button
              className="w-full h-12 text-lg"
              disabled={!templateFile || step === "exporting"}
              onClick={handleExport}
            >
              {step === "exporting" ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Генерация...
                </>
              ) : (
                <>Скачать презентацию</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
