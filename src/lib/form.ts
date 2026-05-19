export function getFormElement<T = HTMLInputElement>(
  form: HTMLFormElement,
  name: string,
) {
  const element = form.elements.namedItem(name);
  if (!element) {
    throw new Error(`Form element with name "${name}" not found`);
  }
  return element as T;
}

export function setFormValue(
  form: HTMLFormElement,
  name: string,
  value: string,
) {
  getFormElement(form, name).value = value;
}
