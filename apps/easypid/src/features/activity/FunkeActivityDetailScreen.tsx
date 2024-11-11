import { Circle, FlexPage, Heading, Paragraph, ScrollView, Stack, YStack } from '@package/ui'
import React from 'react'
import { createParam } from 'solito'

import type { ClaimFormat } from '@credo-ts/core'
import { getPidDisclosedAttributeNames, isPidCredential, usePidCredential } from '@easypid/hooks'
import { getPidAttributesForDisplay } from '@easypid/hooks'
import { useCredentialsWithCustomDisplay } from '@easypid/hooks/useCredentialsWithCustomDisplay'
import { CardWithAttributes, TextBackButton, activityInteractions } from '@package/app'
import { useScrollViewPosition } from '@package/app/src/hooks'
import { formatRelativeDate } from 'packages/utils/src'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'solito/router'
import { RequestPurposeSection } from '../share/components/RequestPurposeSection'
import { useActivities } from './activityRecord'
import { FailedReasonContainer } from './components/FailedReasonContainer'

const { useParams } = createParam<{ id: string }>()

export function FunkeActivityDetailScreen() {
  const { params } = useParams()
  const router = useRouter()
  const { bottom } = useSafeAreaInsets()
  const { pidCredentialForDisplay } = usePidCredential()

  const { activities } = useActivities()
  const { credentials } = useCredentialsWithCustomDisplay()
  const activity = activities.find((activity) => activity.id === params.id)

  if (!activity || activity.type === 'received') {
    // Received activity should route to credential detail (until support for multiple credentials in one request)
    router.back()
    return
  }

  const Icon = activityInteractions[activity.type][activity.status]
  const Title = activityInteractions[activity.type][activity.status].text

  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()

  return (
    <FlexPage p={0} gap={0}>
      <YStack bbw="$0.5" p="$4" borderColor={isScrolledByOffset ? '$grey-200' : '$background'} />
      <ScrollView onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
        <YStack gap="$4" marginBottom={bottom}>
          <Stack h="$8" jc="center" ai="center" pos="relative">
            <Circle pos="absolute" size={72} bg={Icon.color} opacity={0.1} />
            <Circle pos="absolute" size={58} bg={Icon.color} opacity={0.2} />
            <Circle size="$4" bg={Icon.color}>
              <Icon.icon strokeWidth={2} color="$white" />
            </Circle>
          </Stack>
          <YStack gap="$4" px="$4">
            <Stack gap="$2" ai="center">
              <Heading textAlign="center" variant="h1">
                {Title}
              </Heading>
              <Paragraph textAlign="center">{formatRelativeDate(new Date(activity.date), undefined, true)}</Paragraph>
            </Stack>
            <Stack h={1} my="$2" bg="$grey-100" />
            <Stack gap="$6">
              <RequestPurposeSection
                purpose={
                  activity.request.purpose ??
                  'No information was provided on the purpose of the data request. Be cautious'
                }
                logo={activity.entity.logo}
              />
              <Stack gap="$3">
                <Stack gap="$2">
                  <Heading variant="sub2">
                    {activity.status === 'success' ? 'Shared attributes' : 'Requested information'}
                  </Heading>
                  <Paragraph>
                    {activity.status === 'success' ? 'Credentials were shared' : 'No credentials were shared.'}
                  </Paragraph>
                </Stack>
                {activity.request.credentials && activity.request.credentials.length > 0 ? (
                  activity.request.credentials.map((activityCredential) => {
                    const credential = credentials.find((credential) => credential.id.includes(activityCredential.id))

                    if (!credential)
                      return (
                        <CardWithAttributes
                          key={activityCredential.id}
                          id={activityCredential.id}
                          name="Deleted credential"
                          textColor="$grey-100"
                          backgroundColor="$primary-500"
                          disclosedAttributes={activityCredential.disclosedAttributes ?? []}
                          disclosedPayload={activityCredential.disclosedPayload ?? {}}
                          disableNavigation={true}
                        />
                      )

                    const isExpired = credential.metadata.validUntil
                      ? new Date(credential.metadata.validUntil) < new Date()
                      : false

                    const isNotYetActive = credential.metadata.validFrom
                      ? new Date(credential.metadata.validFrom) > new Date()
                      : false

                    if (isPidCredential(credential.metadata.type)) {
                      return (
                        <CardWithAttributes
                          key={pidCredentialForDisplay?.id}
                          id={pidCredentialForDisplay?.id as string}
                          name={pidCredentialForDisplay?.display.name as string}
                          issuerImage={pidCredentialForDisplay?.display.issuer.logo}
                          backgroundImage={pidCredentialForDisplay?.display.backgroundImage}
                          backgroundColor={pidCredentialForDisplay?.display.backgroundColor}
                          textColor={pidCredentialForDisplay?.display.textColor}
                          disclosedAttributes={getPidDisclosedAttributeNames(
                            activityCredential?.disclosedPayload ?? {},
                            credential?.claimFormat as ClaimFormat.SdJwtVc | ClaimFormat.MsoMdoc
                          )}
                          disclosedPayload={getPidAttributesForDisplay(
                            activityCredential?.disclosedPayload ?? {},
                            credential?.claimFormat as ClaimFormat.SdJwtVc | ClaimFormat.MsoMdoc
                          )}
                          isExpired={isExpired}
                          isNotYetActive={isNotYetActive}
                        />
                      )
                    }

                    if (credential)
                      return (
                        <CardWithAttributes
                          key={credential.id}
                          id={credential.id}
                          name={credential.display.name}
                          issuerImage={credential.display.issuer.logo}
                          textColor={credential.display.textColor}
                          backgroundColor={credential.display.backgroundColor}
                          backgroundImage={credential.display.backgroundImage}
                          disclosedAttributes={activityCredential.disclosedAttributes ?? []}
                          disclosedPayload={activityCredential.disclosedPayload ?? {}}
                          disableNavigation={activity.status !== 'success'}
                          isExpired={isExpired}
                          isNotYetActive={isNotYetActive}
                        />
                      )
                  })
                ) : (
                  <FailedReasonContainer reason={activity.request.failureReason ?? 'unknown'} />
                )}
              </Stack>
            </Stack>
          </YStack>
        </YStack>
      </ScrollView>
      <YStack btw="$0.5" borderColor="$grey-200" pt="$4" mx="$-4" px="$4" bg="$background">
        <TextBackButton />
      </YStack>
    </FlexPage>
  )
}
