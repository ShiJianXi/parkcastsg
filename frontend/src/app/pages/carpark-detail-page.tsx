import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  Navigation,
  Heart,
  Bell,
  Cloud,
  Sun,
  CloudRain,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { PremiumModal } from '../components/premium-modal'
import { getAvailabilityColor, type Carpark } from '../data/carparks'
import {
  getCarparkById,
  getCarparkPrediction,
  transformCarpark,
  type CarparkPredictionResponse,
} from '../../api/carparkService'
import { getWeatherForecast, type WeatherData } from '../../api/weatherService'
import { LoadingSkeleton } from '../components/loading-skeleton'
import { NavigationChooserModal } from '../components/navigation-chooser-modal'
import { generatePricingBreakdown } from '../utils/pricingEngine'

type PredictionHorizon = 15 | 30 | 60

interface PredictionRow {
  lotType: string
  values: Partial<
    Record<
      PredictionHorizon,
      {
        predictedAvailableLots: number
        predictedOccupancyRate: number
      }
    >
  >
}

function PredictionSectionSkeleton() {
  return (
    <div className='rounded-lg border border-gray-200 p-4'>
      <div className='mb-3'>
        <div className='h-4 w-28 rounded bg-gray-200 animate-pulse' />
        <div className='mt-2 h-3 w-48 rounded bg-gray-100 animate-pulse' />
      </div>

      <div className='grid grid-cols-3 gap-3'>
        {[15, 30, 60].map((horizon) => (
          <div
            key={horizon}
            className='rounded-lg bg-gray-50 px-3 py-4 text-center'
          >
            <div className='mx-auto h-3 w-14 rounded bg-gray-200 animate-pulse' />
            <div className='mx-auto mt-3 h-8 w-12 rounded bg-gray-200 animate-pulse' />
            <div className='mx-auto mt-2 h-3 w-20 rounded bg-gray-100 animate-pulse' />
          </div>
        ))}
      </div>
    </div>
  )
}

function RateRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2 text-sm">
            <span className="text-gray-500 whitespace-nowrap w-32 shrink-0">{label}</span>
            <span className="text-gray-800">{value}</span>
        </div>
    );
}

export function CarparkDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showNavModal, setShowNavModal] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Dynamic states
  const [carpark, setCarpark] = useState<Carpark | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [prediction, setPrediction] =
    useState<CarparkPredictionResponse | null>(null)
  const [predictionLoading, setPredictionLoading] = useState(true)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let isMounted = true
    const fetchCarparkDetails = async () => {
      setIsLoading(true)
      setError(null)
      setPredictionLoading(true)
      setPredictionError(null)
      try {
        const queryLat = searchParams.get('lat')
        const queryLng = searchParams.get('lng')

        let lat: number | undefined
        let lng: number | undefined

        if (queryLat !== null && queryLng !== null) {
          const parsedLat = parseFloat(queryLat)
          const parsedLng = parseFloat(queryLng)

          if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
            lat = parsedLat
            lng = parsedLng
          }
        }
        // Entering this page only happens after "View full details",
        // so fetching prediction here ties the request to that action.
        const rawDataPromise = getCarparkById(id, lat, lng)
        
        // Predictions are currently supported for HDB and LTA (live) carparks.
        // Supplemental carparks do not have live data and are excluded.
        const canPredict = !id.startsWith('SUPP_')
        
        const rawPredictionPromise = canPredict 
          ? getCarparkPrediction(id).catch(
              (predictionErr) => {
                console.error('Prediction fetch error:', predictionErr)
                if (isMounted) {
                  setPredictionError('Prediction data is temporarily unavailable.')
                }
                return null
              },
            )
          : Promise.resolve(null)

        // Await the carpark details
        const rawData = await rawDataPromise
        const rawWeatherPromise = getWeatherForecast(
          rawData.lat,
          rawData.lng,
        ).catch(() => null)
        if (isMounted) {
          setCarpark(transformCarpark(rawData))
        }

        // Await the prediction and weather promises in parallel after we have the carpark location, so they can load while the user is viewing the details.
        const [rawWeather, rawPrediction] = await Promise.all([
          rawWeatherPromise,
          rawPredictionPromise,
        ])
        if (isMounted) {
          setWeather(rawWeather)
          setPrediction(rawPrediction)
          setPredictionLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to fetch carpark details. Please try again.')
          console.error(err)
          setPredictionLoading(false)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchCarparkDetails()

    return () => {
      isMounted = false
    }
  }, [id, searchParams])

  if (isLoading) {
    return (
      <div className='h-screen bg-[#F9FAFB] flex flex-col p-4'>
        <LoadingSkeleton count={1} />
        <div className='mt-4'>
          <LoadingSkeleton count={3} />
        </div>
      </div>
    )
  }

  if (error || !carpark) {
    return (
      <div className='h-screen flex flex-col bg-[#F9FAFB]'>
        <div className='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center gap-3'>
          <button
            onClick={() => navigate(-1)}
            className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
          >
            <ArrowLeft className='w-5 h-5 text-gray-700' />
          </button>
          <h1 className='text-lg font-semibold text-gray-900 flex-1 truncate'>
            Back
          </h1>
        </div>
        <div className='flex-1 flex flex-col items-center justify-center p-4'>
          <div className='text-center'>
            <div className='w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4'>
              <span className='text-2xl'>😕</span>
            </div>
            <h2 className='text-xl font-semibold text-gray-900 mb-2'>
              {error ? 'Something went wrong' : 'Carpark not found'}
            </h2>
            <p className='text-gray-600 mb-6'>
              {error ||
                "We couldn't find details for this carpark. It might not be under HDB management."}
            </p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </div>
    )
  }

  const getWeatherIcon = (forecast: string) => {
    if (!forecast) return <Sun className='w-8 h-8 text-yellow-500' />
    const lower = forecast.toLowerCase()
    if (
      lower.includes('rain') ||
      lower.includes('shower') ||
      lower.includes('thundery')
    ) {
      return <CloudRain className='w-8 h-8 text-blue-500' />
    } else if (lower.includes('cloud')) {
      return <Cloud className='w-8 h-8 text-gray-400' />
    } else {
      return <Sun className='w-8 h-8 text-yellow-500' />
    }
  }

  const formatLotType = (lotType: string) => {
    switch (lotType) {
      case 'C':
        return 'Car'
      case 'Y':
        return 'Motorcycle'
      case 'H':
        return 'Heavy Vehicle'
      default:
        return lotType || 'Unknown'
    }
  }

  // Re-shape the horizon-first response into lot-type rows so the UI can show
  // one card per lot type with 15 / 30 / 60 minute predictions side-by-side
  const predictionRows: PredictionRow[] = prediction
    ? prediction.predictions.reduce<PredictionRow[]>((rows, snapshot) => {
        for (const lotPrediction of snapshot.by_lot_type) {
          let row = rows.find((item) => item.lotType === lotPrediction.lot_type)
          if (!row) {
            row = { lotType: lotPrediction.lot_type, values: {} }
            rows.push(row)
          }

          row.values[snapshot.horizon_minutes] = {
            predictedAvailableLots: lotPrediction.predicted_available_lots,
            predictedOccupancyRate: lotPrediction.predicted_occupancy_rate,
          }
        }
        return rows
      }, [])
    : []

  const formatPredictionTimestamp = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return date.toLocaleString()
  }

  const formatPredictedLots = (value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1)
  }

  const formatOccupancyRate = (value: number) => {
    return `${(value * 100).toFixed(0)}% occupied`
  }

  return (
    <>
      <div className='min-h-screen bg-[#F9FAFB] pb-24'>
        {/* Header */}
        <div className='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigate(-1)}
              className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
            >
              <ArrowLeft className='w-5 h-5 text-gray-700' />
            </button>
            <h1 className='text-lg font-semibold text-gray-900 flex-1 truncate'>
              {carpark.name}
            </h1>
          </div>
        </div>

        <div className='max-w-2xl mx-auto px-4 py-6 space-y-6'>
          {/* Map Thumbnail */}
          <div className='bg-white rounded-[12px] overflow-hidden shadow-sm border border-gray-200'>
            <div className='h-48 bg-gradient-to-br from-blue-50 to-blue-100 relative flex items-center justify-center'>
              <div className='text-center'>
                <div className='w-12 h-12 bg-[#1A56DB] rounded-full flex items-center justify-center mx-auto mb-2'>
                  <Navigation className='w-6 h-6 text-white' />
                </div>
                {carpark.walkingMinutes ? (
                  <p className='text-sm text-gray-600'>
                    {carpark.walkingMinutes} min walk
                  </p>
                ) : null}
                <p className='text-xs text-gray-500 mt-1'>{carpark.address}</p>
              </div>
            </div>
          </div>

          {/* Availability Section */}
          <div className='bg-white rounded-[12px] p-6 shadow-sm border border-gray-200'>
            <h2 className='text-base font-semibold text-gray-900 mb-4'>
              Current Availability
            </h2>
            <div className='text-center mb-4'>
              <div className='text-4xl font-semibold text-gray-900 mb-2'>
                {carpark.availableLots}{' '}
                <span className='text-2xl text-gray-400'>
                  / {carpark.totalLots}
                </span>
              </div>
              <p className='text-gray-600'>lots available</p>
            </div>

            {/* Crowd Level Bar */}
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-gray-600'>Crowd level</span>
                <span
                  className='font-medium capitalize'
                  style={{
                    color: getAvailabilityColor(carpark.availabilityLevel),
                  }}
                >
                  {carpark.availabilityLevel === 'high'
                    ? 'Low Crowd'
                    : carpark.availabilityLevel === 'moderate'
                      ? 'Moderate'
                      : 'High Crowd'}
                </span>
              </div>
              <div className='h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full transition-all rounded-full'
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        carpark.totalLots > 0
                          ? ((carpark.totalLots -
                              Math.min(
                                carpark.availableLots,
                                carpark.totalLots,
                              )) /
                              carpark.totalLots) *
                              100
                          : 0,
                      ),
                    )}%`,
                    backgroundColor: getAvailabilityColor(
                      carpark.availabilityLevel,
                    ),
                  }}
                />
              </div>
            </div>

            <p className='text-xs text-gray-500 mt-3'>
              Live API from data.gov.sg
            </p>
          </div>

          {carpark.lotTypes && carpark.lotTypes.length > 0 && (
            <div className='bg-white rounded-[12px] p-6 shadow-sm border border-gray-200'>
              <h2 className='text-base font-semibold text-gray-900 mb-4'>
                Lot Type Breakdown
              </h2>
              <div className='space-y-3'>
                {carpark.lotTypes.map((lot) => (
                  <div
                    key={lot.lotType}
                    className='flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3'
                  >
                    <div>
                      <p className='font-medium text-gray-900'>
                        {formatLotType(lot.lotType)}
                      </p>
                      <p className='text-xs text-gray-500'>
                        {lot.totalLots} total lots
                      </p>
                    </div>
                    <p className='text-lg font-semibold text-gray-900'>
                      {lot.availableLots}
                      <span className='text-sm font-normal text-gray-500'>
                        {' '}
                        available
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prediction Section */}
          <div className='bg-white rounded-[12px] p-6 shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-base font-semibold text-gray-900'>
                Predicted Availability by Lot Type
              </h2>
            </div>
            {prediction && (
              <p className='text-xs text-gray-500 mb-4'>
                Generated at{' '}
                {formatPredictionTimestamp(prediction.generated_at)}
              </p>
            )}

            {predictionLoading ? (
              <PredictionSectionSkeleton />
            ) : predictionError ? (
              <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                {predictionError}
              </div>
            ) : predictionRows.length > 0 ? (
              <div className='space-y-4'>
                {predictionRows.map((row) => (
                  <div
                    key={row.lotType}
                    className='rounded-lg border border-gray-200 p-4'
                  >
                    <div className='mb-3'>
                      <p className='font-medium text-gray-900'>
                        {formatLotType(row.lotType)}
                      </p>
                      <p className='text-xs text-gray-500'>
                        Predicted available lots over the next hour
                      </p>
                    </div>

                    <div className='grid grid-cols-3 gap-3'>
                      {([15, 30, 60] as PredictionHorizon[]).map((horizon) => {
                        const value = row.values[horizon]
                        return (
                          <div
                            key={horizon}
                            className='rounded-lg bg-gray-50 px-3 py-4 text-center'
                          >
                            <p className='text-xs font-medium uppercase tracking-wide text-gray-500'>
                              {horizon === 60 ? '1 hour' : `${horizon} min`}
                            </p>
                            <p className='mt-2 text-2xl font-semibold text-gray-900'>
                              {value
                                ? formatPredictedLots(
                                    value.predictedAvailableLots,
                                  )
                                : '--'}
                            </p>
                            <p className='mt-1 text-xs text-gray-500'>
                              {value
                                ? formatOccupancyRate(
                                    value.predictedOccupancyRate,
                                  )
                                : 'Pending model output'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600'>
                {id?.startsWith('SUPP_')
                  ? 'Predictions are not available for this carpark. Live lot availability data is required for forecasting, and is currently only provided by the HDB and LTA APIs.'
                  : 'Prediction data is not available yet for this carpark.'}
              </div>
            )}
          </div>

          {/* Pricing Section */}
          <div className='bg-white rounded-[12px] p-6 shadow-sm border border-gray-200'>
            <h2 className='text-base font-semibold text-gray-900 mb-4'>
              Detailed Pricing
            </h2>
            {(() => {
              const breakdown = generatePricingBreakdown(carpark)
              return (
                <div className='space-y-6'>
                  {/* Motor Car */}
                  <div>
                    <h3 className='font-medium text-gray-900 flex items-center gap-2 mb-2'>
                      <span>🚗</span> Motor Car
                    </h3>
                    <ul className='list-disc list-inside text-sm text-gray-600 space-y-1'>
                      {breakdown.car.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Motorcycle */}
                  <div className='border-t border-gray-100 pt-4'>
                    <h3 className='font-medium text-gray-900 flex items-center gap-2 mb-2'>
                      <span>🏍️</span> Motorcycle
                    </h3>
                    <ul className='list-disc list-inside text-sm text-gray-600 space-y-1'>
                      {breakdown.motorcycle.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Heavy Vehicle */}
                  <div className='border-t border-gray-100 pt-4'>
                    <h3 className='font-medium text-gray-900 flex items-center gap-2 mb-2'>
                      <span>🚚</span> Heavy Vehicle
                    </h3>
                    <ul className='list-disc list-inside text-sm text-gray-600 space-y-1'>
                      {breakdown.heavy.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Weather Section */}
          <div className='bg-white rounded-[12px] p-6 shadow-sm border border-gray-200'>
            <h2 className='text-base font-semibold text-gray-900 mb-4'>
              Weather & Shelter
            </h2>

            <div className='flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg'>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  carpark.isSheltered ? 'bg-green-100' : 'bg-gray-200'
                }`}
              >
                <span className='text-lg'>
                  {carpark.isSheltered ? '✓' : '✗'}
                </span>
              </div>
              <div>
                <p className='font-medium text-gray-900'>
                  Sheltered parking: {carpark.isSheltered ? 'Yes' : 'No'}
                </p>
                <p className='text-sm text-gray-600'>
                  {carpark.isSheltered
                    ? 'Protected from rain and sun'
                    : 'Open-air parking'}
                </p>
              </div>
            </div>

            <div>
              <p className='text-sm text-gray-600 mb-3'>
                Live 2-hour forecast for {weather?.area || 'this area'}{' '}
                {weather?.validPeriod && (
                  <span className='text-xs text-gray-500 font-medium'>
                    ({weather.validPeriod})
                  </span>
                )}
              </p>
              <div className='flex flex-col items-center p-4 bg-gray-50 rounded-lg border border-gray-100'>
                {weather ? (
                  <>
                    <div className='mb-2'>
                      {getWeatherIcon(weather.forecast)}
                    </div>
                    <p className='text-sm font-medium text-gray-900'>
                      {weather.forecast}
                    </p>
                  </>
                ) : (
                  <p className='text-sm text-gray-500'>
                    Weather data unavailable
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg'>
        <div className='max-w-2xl mx-auto flex gap-3'>
          <Button
            onClick={() => setShowNavModal(true)}
            className='flex-1 bg-[#1A56DB] hover:bg-[#1444b8] text-white rounded-lg py-6'
          >
            <Navigation className='w-4 h-4 mr-2' />
            Navigate Here
          </Button>
          <Button
            onClick={() => setIsSaved(!isSaved)}
            variant='outline'
            className={`px-6 py-6 rounded-lg ${
              isSaved ? 'bg-pink-50 border-pink-300 text-pink-600' : ''
            }`}
          >
            <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </Button>
          <Button
            onClick={() => setShowPremiumModal(true)}
            variant='outline'
            className='px-6 py-6 rounded-lg border-amber-300 text-amber-600 hover:bg-amber-50'
          >
            <Bell className='w-5 h-5' />
          </Button>
        </div>
      </div>

      {/* Navigation Chooser Modal */}
      <NavigationChooserModal
        isOpen={showNavModal}
        onClose={() => setShowNavModal(false)}
        lat={carpark.lat}
        lng={carpark.lng}
        address={carpark.address}
      />

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />
    </>
  )
}
