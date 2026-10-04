/** One still in the full-screen viewer. Plain data, so it can cross from the server to the lazy viewer. */
export type ViewerItem = {
  id: string;
  alt: string;
  /** The beat it belongs to, when it has one. */
  caption: string | null;
  frame: "browser" | "phone";
  avifSet: string;
  webpSet: string;
  src: string;
  width: number;
  height: number;
};
