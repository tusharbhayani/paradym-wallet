import { useCredentialsWithCustomDisplay } from '@easypid/hooks/useCredentialsWithCustomDisplay'
import { useHaptics, useScrollViewPosition } from '@package/app/src/hooks'
import {
  AnimatedStack,
  FlexPage,
  Heading,
  HeroIcons,
  IconContainer,
  Image,
  Input,
  Loader,
  LucideIcons,
  Paragraph,
  ScrollView,
  Spacer,
  Stack,
  XStack,
  YStack,
  useScaleAnimation,
} from '@package/ui'
import { useRouter } from 'expo-router'
import type { DisplayImage } from 'packages/agent/src'
import { TextBackButton } from 'packages/app/src'
import { formatDate } from 'packages/utils/src'
import React, { useMemo, useState } from 'react'
import { FadeInDown } from 'react-native-reanimated'

export function FunkeCredentialsScreen() {
  const { credentials, isLoading: isLoadingCredentials } = useCredentialsWithCustomDisplay()

  const [searchQuery, setSearchQuery] = useState('')
  const filteredCredentials = useMemo(() => {
    return credentials.filter((credential) => credential.display.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [credentials, searchQuery])

  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()
  const { push } = useRouter()
  const { withHaptics } = useHaptics()

  const pushToCredential = withHaptics((id: string) => push(`/credentials/${id}`))

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <YStack w="100%" top={0} borderBottomWidth="$0.5" borderColor={isScrolledByOffset ? '$grey-200' : '$background'}>
        <YStack gap="$2" p="$4">
          <Stack h="$1" />
          <Heading variant="h1">Cards</Heading>
        </YStack>
      </YStack>
      {credentials.length === 0 ? (
        <AnimatedStack
          flexDirection="column"
          entering={FadeInDown.delay(300).springify().mass(1).damping(16).stiffness(140).restSpeedThreshold(0.1)}
          gap="$2"
          jc="center"
          p="$4"
          fg={1}
        >
          <Heading ta="center" variant="h3" fontWeight="$semiBold">
            There's nothing here, yet
          </Heading>
          <Paragraph ta="center">Credentials will appear here once you receive them.</Paragraph>
        </AnimatedStack>
      ) : isLoadingCredentials ? (
        <YStack fg={1} ai="center" jc="center">
          <Loader />
          <Spacer size="$12" />
        </YStack>
      ) : (
        <ScrollView px="$4" onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
          <Stack position="relative">
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              pl="$7"
              mb="$4"
              bg="$grey-50"
              placeholderTextColor="$grey-500"
              borderColor="$borderTranslucent"
              placeholder="Search cards"
            />
            <HeroIcons.MagnifyingGlass
              size={20}
              strokeWidth={2.5}
              color="$grey-400"
              position="absolute"
              top={12} // Positions icon in the middle of standard input height
              left="$3"
            />
          </Stack>
          <YStack fg={1} gap="$2">
            {filteredCredentials.length > 0 ? (
              filteredCredentials.map((credential) => (
                <FunkeCredentialRowCard
                  key={credential.id}
                  name={credential.display.name}
                  textColor={credential.display.textColor ?? '$grey-900'}
                  backgroundColor={credential.display.backgroundColor ?? '$grey-100'}
                  issuer={credential.display.issuer.name}
                  logo={credential.display.issuer.logo}
                  onPress={() => {
                    pushToCredential(credential.id)
                  }}
                />
              ))
            ) : (
              <Paragraph mt="$8" ta="center">
                No cards found for "{searchQuery}"
              </Paragraph>
            )}
          </YStack>
        </ScrollView>
      )}
      <YStack btw="$0.5" borderColor="$grey-200" pt="$4" mx="$-4" px="$4" bg="$background">
        <TextBackButton />
      </YStack>
    </FlexPage>
  )
}

interface FunkeCredentialRowCardProps {
  name: string
  backgroundColor: string
  textColor: string
  issuer: string
  logo: DisplayImage | undefined
  onPress: () => void
}

function FunkeCredentialRowCard({ name, backgroundColor, textColor, logo, onPress }: FunkeCredentialRowCardProps) {
  const { pressStyle, handlePressIn, handlePressOut } = useScaleAnimation({ scaleInValue: 0.99 })

  const icon = logo?.url ? (
    <Image src={logo.url} width={36} height={36} />
  ) : (
    <XStack width={36} height={36} bg="$lightTranslucent" ai="center" jc="center" br="$12">
      <LucideIcons.FileBadge size={20} strokeWidth={2.5} color="$grey-100" />
    </XStack>
  )

  return (
    <AnimatedStack
      flexDirection="row"
      bg={backgroundColor}
      gap="$4"
      ai="center"
      borderWidth="$0.5"
      borderColor="$borderTranslucent"
      br="$6"
      p="$4"
      style={pressStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      {icon}
      <YStack gap="$1" jc="center" fg={1}>
        <Paragraph mt="$-1.5" fontSize={14} fontWeight="$bold" color={textColor} numberOfLines={1}>
          {name.toLocaleUpperCase()}
        </Paragraph>
        <Paragraph variant="sub" opacity={0.9} color={textColor}>
          Issued on {formatDate(new Date(), { includeTime: false })}
        </Paragraph>
      </YStack>
      <IconContainer icon={<HeroIcons.ArrowRight color={textColor} size={20} />} />
    </AnimatedStack>
  )
}