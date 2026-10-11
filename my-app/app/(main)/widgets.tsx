import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Screen, Text, Spacer, useLovasTheme } from '@/components/ui';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useBoardContent } from '@/hooks/widgets/useBoardContent';
import { CoupleArtCard } from '@/components/widgets/CoupleArtCard';
import {
  DEFAULT_WIDGET_CONTENT,
  type WidgetContent,
  type WidgetVariant,
} from '@/lib/widgets/types';

const ACCENT_OPTIONS = ['#FF5A79', '#9B6BFF', '#FFB84D', '#2FA36B', '#E5484D', '#4A90E2'];

const VARIANTS: { value: WidgetVariant; label: string }[] = [
  { value: 'heart', label: 'Heart' },
  { value: 'heartTitle', label: 'Heart + name' },
  { value: 'heartNote', label: 'Heart + note' },
  { value: 'heartTitleNote', label: 'Full card' },
];

export default function WidgetsScreen() {
  const { theme } = useLovasTheme();
  const { local, couple } = useCoupleContext();
  const { deviceId } = useDevice();

  const boardId = local?.boardId ?? '';
  const boardName = local?.boardName ?? 'Our Board';

  const { content, loading, serverConnected, partnerOnline, saveContent } = useBoardContent({
    boardId,
    boardName,
    deviceId: deviceId ?? '',
    enabled: Boolean(boardId && deviceId),
  });

  const [title, setTitle] = useState(boardName);
  const [note, setNote] = useState('');
  const titleFocused = useRef(false);
  const noteFocused = useRef(false);

  // Keep the text inputs in sync when content changes from elsewhere (partner
  // edits), unless the user is actively typing in that field.
  useEffect(() => {
    if (!content) return;
    if (!titleFocused.current) setTitle(content.title);
    if (!noteFocused.current) setNote(content.message);
  }, [content, content?.title, content?.message]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      saveContent({ title: value });
    },
    [saveContent]
  );

  const handleNoteChange = useCallback(
    (value: string) => {
      setNote(value);
      saveContent({ message: value });
    },
    [saveContent]
  );

  const setAccent = useCallback(
    (accentColor: string) => saveContent({ accentColor }),
    [saveContent]
  );

  const setVariant = useCallback(
    (variant: WidgetVariant) => saveContent({ variant }),
    [saveContent]
  );

  const preview: WidgetContent = content ?? {
    ...DEFAULT_WIDGET_CONTENT,
    boardId,
    title: boardName,
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Spacer size={12} />

          <View style={styles.greetingRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
              <Text variant="h3" color={theme.primary}>
                💝
              </Text>
            </View>
            <View style={styles.greetingText}>
              <Text variant="h2">You + Partner</Text>
              <Text variant="caption" color={theme.textMuted}>
                {couple?.pairCode ? `Paired · code ${couple.pairCode}` : 'Not paired yet'}
              </Text>
            </View>
          </View>

          <Spacer size={8} />
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: serverConnected ? theme.success : theme.accent },
              ]}
            />
            <Text variant="caption" color={theme.textMuted}>
              {loading
                ? 'Getting your widget ready…'
                : serverConnected
                  ? partnerOnline
                    ? 'Live — your partner sees this board'
                    : 'Live — syncs to your partner'
                  : 'Editing locally — sync coming soon'}
            </Text>
          </View>

          <Spacer size={24} />

          {/* Live preview */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text variant="caption" color={theme.textMuted}>
              Your widget
            </Text>
            <Spacer size={8} />
            <View style={styles.previewRow}>
              <CoupleArtCard content={preview} width={150} height={150} />
              <CoupleArtCard content={preview} width={190} height={92} />
            </View>
            <Spacer size={12} />
            <CoupleArtCard
              content={preview}
              width={120}
              height={120}
              circular
              style={styles.previewSelfCenter}
            />
            <Spacer size={4} />
            <Text variant="caption" color={theme.textMuted} style={styles.previewSelfCenter}>
              Lock screen
            </Text>
          </View>

          <Spacer size={24} />

          <Text variant="bodyStrong">Board name</Text>
          <Spacer size={8} />
          <TextInput
            value={title}
            onChangeText={handleTitleChange}
            onFocus={() => (titleFocused.current = true)}
            onBlur={() => (titleFocused.current = false)}
            maxLength={40}
            placeholder="Our Board"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
          />

          <Spacer size={20} />
          <Text variant="bodyStrong">Love note</Text>
          <Spacer size={4} />
          <Text variant="caption" color={theme.textMuted}>
            A short message on your partner's home screen.
          </Text>
          <Spacer size={8} />
          <TextInput
            value={note}
            onChangeText={handleNoteChange}
            onFocus={() => (noteFocused.current = true)}
            onBlur={() => (noteFocused.current = false)}
            maxLength={80}
            multiline
            numberOfLines={2}
            placeholder="Made with 💝 in Lovas"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              styles.inputMultiline,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
          />

          <Spacer size={20} />
          <Text variant="bodyStrong">Accent color</Text>
          <Spacer size={12} />
          <View style={styles.swatches}>
            {ACCENT_OPTIONS.map(color => {
              const selected = color === preview.accentColor;
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => setAccent(color)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    selected && styles.swatchSelected,
                  ]}
                >
                  {selected && <View style={styles.swatchCheck} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <Spacer size={20} />
          <Text variant="bodyStrong">Layout</Text>
          <Spacer size={12} />
          <View style={styles.variantRow}>
            {VARIANTS.map(v => {
              const selected = v.value === preview.variant;
              return (
                <TouchableOpacity
                  key={v.value}
                  onPress={() => setVariant(v.value)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: theme.card },
                    selected && { borderColor: theme.primary, backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <Text color={selected ? theme.primary : theme.textMuted} variant="caption">
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Spacer size={28} />
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text variant="bodyStrong">Add it to your home screen</Text>
            <Spacer size={8} />
            <HowToStep step="1" text="Press and hold on the home screen." />
            <Spacer size={8} />
            <HowToStep step="2" text="Tap + in the top-left corner." />
            <Spacer size={8} />
            <HowToStep step="3" text="Search for Lovas, then add a size you like." />
            <Spacer size={8} />
            <HowToStep
              step="4"
              text="On the lock screen, swipe right to edit and add it there too."
            />
          </View>

          <Spacer size={40} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function HowToStep({ step, text }: { step: string; text: string }) {
  const { theme } = useLovasTheme();
  return (
    <View style={styles.howToRow}>
      <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
        <Text variant="caption" color={theme.primary}>
          {step}
        </Text>
      </View>
      <Text variant="body" style={styles.howToText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewSelfCenter: {
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: '#3A2A2F',
  },
  swatchCheck: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howToText: {
    flex: 1,
  },
});
