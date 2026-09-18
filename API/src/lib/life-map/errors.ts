export class LifeMapProfileMissingError extends Error {
	constructor() {
		super("space_profile.birth_date is required for life-map projection");
		this.name = "LifeMapProfileMissingError";
	}
}
