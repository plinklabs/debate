// HTML made as text, for the report file (#7). Names, topics and labels are
// typed by people, so text is escaped by default: the `markup` template
// escapes every value put into it, unless that value is `Markup` made here.
// (Not called `html`: Prettier would format such a template as a page.)

/** HTML that is safe to put in a page as it is: made by `markup`, or trusted text from this code. */
export class Markup {
  constructor(readonly html: string) {}

  toString(): string {
    return this.html;
  }
}

/** What a template takes: text (escaped), markup (as it is), lists of these, or nothing. */
export type Part = Markup | string | number | null | undefined | false | readonly Part[];

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text as HTML: safe as an element's text and inside a quoted attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/** Markup that this code made itself, such as a style sheet: not escaped. */
export function trusted(html: string): Markup {
  return new Markup(html);
}

function render(part: Part): string {
  if (part instanceof Markup) return part.html;
  if (Array.isArray(part)) return part.map(render).join('');
  if (part === null || part === undefined || part === false) return '';
  return escapeHtml(String(part));
}

/** Markup from a template, with every value in it escaped unless it is `Markup`. */
export function markup(strings: TemplateStringsArray, ...values: readonly Part[]): Markup {
  let out = strings[0];
  values.forEach((value, index) => {
    out += render(value) + strings[index + 1];
  });
  return new Markup(out);
}
