import { CodedError } from '$lib/model/Errors/CodedError';
import type { JsonObject } from '$lib/state/triplit/types';
import type { TraceScalarFieldDraft } from './types';
import { requiredLabel, uniqueMachineKey } from './keys';

export function compileScalarField(
	field: TraceScalarFieldDraft,
	node: JsonObject,
	previousUi: JsonObject
): { node: JsonObject; ui: JsonObject } {
	const label = field.label;
	let ui: JsonObject = {
		...previousUi,
		'ui:options': { ...((previousUi['ui:options'] as JsonObject) ?? {}) }
	};
	switch (field.kind) {
		case 'text':
		case 'textarea':
			node.type = 'string';
			if (field.kind === 'textarea')
				ui = { ...ui, 'ui:components': { textWidget: 'textareaWidget' } };
			break;
		case 'number':
		case 'integer':
			node.type = field.kind;
			break;
		case 'boolean':
			node.type = 'boolean';
			if (field.initial !== undefined) node.default = field.initial;
			else delete node.default;
			break;
		case 'date':
		case 'datetime':
			node.type = 'string';
			node.format = field.kind === 'date' ? 'date' : 'date-time';
			if (field.kind === 'date')
				ui['ui:options'] = { ...(ui['ui:options'] as JsonObject), text: { type: 'date' } };
			else ui['ui:components'] = { textWidget: 'dateTimeWidget' };
			break;
		case 'choice':
		case 'multi-choice': {
			if (!field.options.length)
				throw new CodedError('form_choice_options', `${label}: at least one option`, {
					field: label
				});
			const optionKeys = new Set<string>();
			const optionLabels = new Set<string>();
			const oneOf = field.options.map((option) => {
				const title = requiredLabel(option.label, 'option', label);
				if (optionLabels.has(title.toLocaleLowerCase('ru')))
					throw new CodedError('form_choice_duplicate', 'option names must differ', {
						field: label
					});
				optionLabels.add(title.toLocaleLowerCase('ru'));
				const value = option.key ?? uniqueMachineKey(title, optionKeys, 'option');
				if (option.key && optionKeys.has(value))
					throw new CodedError('form_choice_keys', 'option keys must differ', { field: label });
				optionKeys.add(value);
				return { const: value, title };
			});
			if (field.kind === 'choice') {
				node.type = 'string';
				node.oneOf = oneOf;
				delete node.enum;
			} else {
				node.type = 'array';
				node.uniqueItems = true;
				node.items = { type: 'string', oneOf };
			}
			break;
		}
	}
	for (const constraint of ['minimum', 'maximum', 'minLength', 'maxLength'] as const) {
		if (field[constraint] !== undefined) node[constraint] = field[constraint];
		else delete node[constraint];
	}
	return { node, ui };
}
