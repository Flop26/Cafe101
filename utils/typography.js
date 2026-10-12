import { Dimensions } from 'react-native';

const tabletBreakpoint = 640;

export function scaleTabletTypography(styles) {
	if (Dimensions.get('window').width < tabletBreakpoint) return styles;

	return Object.fromEntries(Object.entries(styles).map(([name, style]) => {
		if (typeof style?.fontSize !== 'number') return [name, style];
		return [name, { ...style, fontSize: style.fontSize <= 12 ? style.fontSize + 2 : style.fontSize + 1 }];
	}));
}