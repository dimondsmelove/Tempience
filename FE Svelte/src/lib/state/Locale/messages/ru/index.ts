import common from './common.json';
import draft from './draft.json';
import result from './result.json';
import history from './history.json';
import scope from './scope.json';
import errors from './errors.json';
import validation from './validation.json';
import forms from './forms.json';
import theme from './theme.json';

import time from './time.json';

import context from './context.json';

import timeline from './timeline.json';

import life from './life.json';

import onboarding from './onboarding.json';
import demo from './demo.json';

/** The Russian catalog: one JSON per area, one flat key space. */
export const ru = {
	...common,
	...draft,
	...result,
	...history,
	...scope,
	...errors,
	...validation,
	...forms,
	...theme,
	...time,
	...context,
	...timeline,
	...life,
	...onboarding,
	...demo
};
