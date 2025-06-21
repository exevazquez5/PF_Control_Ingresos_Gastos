export function parseJwt(token) {
  if (!token) return null;
  try {
    const base64Payload = token.split('.')[1];
    const jsonPayload = decodeURIComponent(
      atob(base64Payload)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}
