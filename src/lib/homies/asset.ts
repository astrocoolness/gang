// next/image does not prefix basePath onto string srcs, so public assets need it spelled out.
export const BASE_PATH = '/clique';
export function asset(path: string) {
  if (!path.startsWith('/') || path.startsWith(BASE_PATH + '/')) return path;
  return BASE_PATH + path;
}
