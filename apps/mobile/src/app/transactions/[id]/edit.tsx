import { useLocalSearchParams } from "expo-router"
import { TransactionEditorScreen } from "../../../features/transactions/TransactionEditor"

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <TransactionEditorScreen transactionId={id} />
}
