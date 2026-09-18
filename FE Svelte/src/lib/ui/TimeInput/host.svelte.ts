import { getContext, setContext, type Snippet } from 'svelte';
import type { SheetPosition } from '$lib/ui/BottomSheet/types';
import type { TimeInputState } from './TimeInputState.svelte';

type Editor = {
	picker: TimeInputState;
	header: Snippet;
	overlay: Snippet;
	actions: Snippet;
	close: () => void;
};
const key = Symbol('time-input-host');

/** Optional host: the same input also works in forms outside Workbench. */
export class TimeInputHost {
	editor = $state.raw<Editor | null>(null);
	phone = $state(false);
	position = $state<SheetPosition>('full');
	activate(editor: Editor) {
		this.editor = editor;
		this.position = 'full';
	}
	release(picker: TimeInputState) {
		if (this.editor?.picker === picker) this.editor = null;
	}
	switchInput(input: 'picker' | 'timeline') {
		this.editor?.picker.switchInput(input);
		this.position = input === 'timeline' ? 'peek' : 'full';
	}
}
export const provideTimeInputHost = () => setContext(key, new TimeInputHost());
export const getTimeInputHost = () => getContext<TimeInputHost | undefined>(key);
