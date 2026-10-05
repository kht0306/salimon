import styled from "@emotion/native"
import { nativeTypography } from "@salimon/ui-tokens"

export const AppText = styled.Text`
  font-family: Pretendard;
  color: ${({ theme }) => theme.colors.ink};
  font-size: ${nativeTypography.body.fontSize}px;
  font-weight: ${nativeTypography.body.fontWeight};
`
