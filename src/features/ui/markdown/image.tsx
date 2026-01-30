import { ImageLightbox } from "./image-lightbox";

export const image = {
  render: "MarkdownImage",
  attributes: {
    src: { type: String, required: true },
    alt: { type: String },
    title: { type: String },
  },
};

export const MarkdownImage = ({
  src,
  alt,
  title,
}: {
  src: string;
  alt?: string;
  title?: string;
}) => {
  // Normalize URL: strip leading ./ if present (OpenAI sometimes adds this)
  // Ensures ./api/images?... becomes /api/images?...
  const normalizedSrc = src.startsWith('./') ? src.substring(1) : src;
  
  return <ImageLightbox src={normalizedSrc} alt={alt || title || "Image"} />;
};
