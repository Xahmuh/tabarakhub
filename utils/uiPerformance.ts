export const runAfterNextPaint = <T>(task: () => T | Promise<T>): Promise<T> => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve().then(task);
  }

  return new Promise<T>((resolve, reject) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        Promise.resolve()
          .then(task)
          .then(resolve)
          .catch(reject);
      });
    });
  });
};
