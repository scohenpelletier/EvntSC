/** True for addresses at usc.edu or a usc.edu subdomain (e.g. ttrojan@usc.edu, x@marshall.usc.edu). */
export function isUscEmail(email: string): boolean {
  return /^[^\s@]+@([a-z0-9-]+\.)*usc\.edu$/i.test(email.trim());
}
