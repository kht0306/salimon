import { TransactionEditorScreen } from "../../features/transactions/TransactionEditor"
import { useLocalSearchParams } from "expo-router"

export default function NewTransactionRoute() {
  const { copyId } = useLocalSearchParams<{ copyId?: string }>()
  return <TransactionEditorScreen copyTransactionId={copyId} />
}
