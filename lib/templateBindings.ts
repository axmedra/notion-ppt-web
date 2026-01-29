import type { TemplateBinding } from "./types";

export const defaultTemplateBindings: Record<string, TemplateBinding> = {
  Text: {
    templateSlideNumber: 1,
    shapes: {
      title: "Title",
      header: "Верхний колонтитул",
      body: "Body",
    },
  },
  Table: {
    templateSlideNumber: 1,
    shapes: {
      title: "Title",
      header: "Верхний колонтитул",
      table: "Table",
    },
  },
  Screenshot: {
    templateSlideNumber: 1,
    shapes: {
      title: "Title",
      header: "Верхний колонтитул",
      image1: "Image 1",
      image2: "Image 2",
      image3: "Image 3",
      body: "Body",
    },
  },
  "Text+Screenshot": {
    templateSlideNumber: 1,
    shapes: {
      title: "Title",
      header: "Верхний колонтитул",
      body: "Body",
      bankName1: "BankName1",
      bankName2: "BankName2",
      bankName3: "BankName3",
      imageCaption1: "Под картинкой 1",
      imageCaption2: "Под картинкой 2",
      imageCaption3: "Под картинкой 3",
      image1: "Image 1",
      image2: "Image 2",
      image3: "Image 3",
    },
  },
};
