import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { resolveRecipeImageUrl } from '../services/media/recipeImages';

interface RecipeImageProps {
  imageUrl?: string;
  imageStoragePath?: string;
  gradient: [string, string];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function RecipeImage({
  imageUrl,
  imageStoragePath,
  gradient,
  style,
  children,
}: RecipeImageProps) {
  const [signedUrl, setSignedUrl] = useState<string>();
  const [storageFailed, setStorageFailed] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    setSignedUrl(undefined);
    setStorageFailed(false);
    setFailedUrl(undefined);

    if (!imageStoragePath) return () => {
      active = false;
    };

    void resolveRecipeImageUrl(imageStoragePath)
      .then((url) => {
        if (active) setSignedUrl(url);
      })
      .catch(() => {
        if (active) setStorageFailed(true);
      });

    return () => {
      active = false;
    };
  }, [imageStoragePath, imageUrl]);

  const storageUrl = storageFailed || failedUrl === signedUrl ? undefined : signedUrl;
  const sourceUrl = storageUrl ?? (failedUrl === imageUrl ? undefined : imageUrl);

  return (
    <View style={[styles.container, style]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {sourceUrl ? (
        <Image
          source={{ uri: sourceUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={`${imageStoragePath ?? 'external'}:${sourceUrl}`}
          onError={() => setFailedUrl(sourceUrl)}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
