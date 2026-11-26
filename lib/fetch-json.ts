/**
 * POST JSON to one of NoteWise's own routes.
 *
 * A dropped connection (mobile data, a platform timeout) makes fetch throw a
 * TypeError whose message is the browser's raw "Failed to fetch". That text
 * must never reach a student, so a network failure is retried once and then
 * reported as a ConnectionError, which screens translate into plain words.
 */
export class ConnectionError extends Error {
  constructor() {
    super("The connection dropped.");
    this.name = "ConnectionError";
  }
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (caught) {
      if (!(caught instanceof TypeError)) throw caught;
      // A network failure: fall through and try once more.
    }
  }
  throw new ConnectionError();
}
