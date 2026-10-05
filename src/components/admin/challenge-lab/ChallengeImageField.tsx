'use client'

import { Input } from '@/components/ui/input'
import { CHALLENGE_IMAGE_HOSTS, isAllowedChallengeImageUrl } from '@/lib/challenge-images'
import { ChallengeCover } from '@/components/challenges/ChallengeCover'
import { cn } from '@/lib/utils'

/**
 * An image URL with a live preview, for a challenge cover or a day image.
 * Says right away when a link cannot be shown, rather than at save time.
 */
export function ChallengeImageField({
  id,
  label,
  value,
  onChange,
  previewClassName,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Size of the preview, e.g. a wide banner for the cover, a thumbnail for a day. */
  previewClassName: string
}) {
  const trimmed = value.trim()
  const invalid = trimmed.length > 0 && !isAllowedChallengeImageUrl(trimmed)

  return (
    <div className="flex items-start gap-3">
      <ChallengeCover src={invalid ? null : trimmed} alt="" className={cn('shrink-0 rounded-lg', previewClassName)} sizes="160px" />
      <div className="min-w-0 flex-1 space-y-1">
        <Input
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`${label}: https://${CHALLENGE_IMAGE_HOSTS[0]}/photo-…`}
        />
        <p className={cn('text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>
          {invalid
            ? `This link cannot be shown. Use an https image link from ${CHALLENGE_IMAGE_HOSTS.join(' or ')}.`
            : `Optional. An image link from ${CHALLENGE_IMAGE_HOSTS.join(' or ')}, like the article covers.`}
        </p>
      </div>
    </div>
  )
}
