import React from 'react';
import { Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';

const logo = require('../../assets/magnom-logo.png');

interface Props {
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  rounded?: boolean;
}

export function MagnomLogo({ size = 100, style, imageStyle, rounded = true }: Props) {
  return (
    <Image
      source={logo}
      style={[
        styles.image,
        {
          width: size,
          height: size,
          borderRadius: rounded ? size * 0.22 : 0,
        },
        imageStyle,
      ]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
});
