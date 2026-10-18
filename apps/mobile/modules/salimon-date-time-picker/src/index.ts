import { requireOptionalNativeModule } from "expo"

export interface SalimonDateTimePickerNativeModule {
  pickDate(value: string, darkMode: boolean): Promise<string | null>
  pickTime(value: string, darkMode: boolean): Promise<string | null>
}

export default requireOptionalNativeModule<SalimonDateTimePickerNativeModule>(
  "SalimonDateTimePicker",
)
