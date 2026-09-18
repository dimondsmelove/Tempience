import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'place.chronograph.app',
	appName: 'Tempience',
	webDir: 'build',
	server: {
		androidScheme: 'https'
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 0
		},
		StatusBar: {
			style: 'DARK'
		}
	}
};

export default config;
