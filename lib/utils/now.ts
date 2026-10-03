/** Server render timestamp. Lives outside components so render functions stay pure (react-hooks/purity). */
export const nowMs = () => Date.now();
