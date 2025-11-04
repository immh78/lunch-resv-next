'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import PhoneIcon from '@mui/icons-material/Phone';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

interface Restaurant {
  id: string;
  name: string;
  telNo: string;
}

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const restaurantsRef = ref(database, 'food-resv/restaurant');
    
    const unsubscribe = onValue(
      restaurantsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const restaurantList: Restaurant[] = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
          setRestaurants(restaurantList);
          setError('');
        } else {
          setRestaurants([]);
          setError('레스토랑 데이터가 없습니다.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching restaurants:', err);
        setError('레스토랑 데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ProtectedRoute>
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            포장 예약
          </Typography>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '50vh',
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : (
            <Box sx={{ mt: 3 }}>
              {restaurants.length === 0 ? (
                <Typography variant="body1" align="center" sx={{ mt: 4 }}>
                  등록된 레스토랑이 없습니다.
                </Typography>
              ) : (
                restaurants.map((restaurant) => (
                  <Card key={restaurant.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" component="h2" gutterBottom>
                        식당: {restaurant.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon color="primary" />
                        <Typography variant="body1">
                          전화:{' '}
                          <Link
                            href={`tel:${restaurant.telNo}`}
                            sx={{ textDecoration: 'none' }}
                          >
                            {restaurant.telNo}
                          </Link>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}
        </Container>
      </ProtectedRoute>
    </ThemeProvider>
  );
}
