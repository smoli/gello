import { useEffect, useRef, useState } from "react";

/**
 * c011/c012: a Markdown image whose src is resolved to a displayable URL.
 * Local asset paths can't load from the webview origin, so `loadImage` turns
 * them into data URLs; remote/data URLs pass straight through. Renders nothing
 * when the src can't be resolved or the image fails to load — c012 wants
 * broken links to degrade silently, no error flood.
 */
export function AssetImage({
  src,
  alt,
  loadImage,
  className,
}: {
  src: string;
  alt: string;
  loadImage?: (src: string) => Promise<string | null>;
  className?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(
    loadImage ? null : src,
  );
  // resolve only when the src changes, not when the (inline) loadImage prop
  // gets a new identity each parent render
  const loadImageRef = useRef(loadImage);
  loadImageRef.current = loadImage;
  useEffect(() => {
    const resolve = loadImageRef.current;
    if (!resolve || src === "") {
      setResolved(src || null);
      return;
    }
    let alive = true;
    void resolve(src).then((url) => {
      if (alive) setResolved(url);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!resolved) return null;
  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      onError={() => setResolved(null)}
    />
  );
}
