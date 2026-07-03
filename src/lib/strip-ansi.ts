// Strip ANSI escape sequences and non-printable control chars from log text
// before rendering in the live-log console. Mirrors the VSCode extension's
// log cleanup so streamed docker output renders as plain text.

// CSI / OSC / general ESC sequences.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b[[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-nqry=><~]/g;

// C0/C1 control chars except \t (\x09) and \n (\x0a). \r (\x0d) is dropped too
// so CRLF collapses to LF cleanly.
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, '');
}

export function cleanLogText(input: string): string {
  return stripAnsi(input).replace(CONTROL_PATTERN, '');
}
