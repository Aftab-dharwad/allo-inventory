import { ReservationClient } from "./ReservationClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReservationPage({ params }: Props) {
  const { id } = await params;
  return <ReservationClient reservationId={id} />;
}
