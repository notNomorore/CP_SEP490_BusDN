import { Redirect } from 'expo-router';

export default function BuyMonthlyPassScreen() {
  return <Redirect href={{ pathname: '/buy-oneway-ticket', params: { ticketType: 'MONTHLY_PASS' } }} />;
}
