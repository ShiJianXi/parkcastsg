import { createLayerComponent, LayerProps } from '@react-leaflet/core'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { ReactNode } from 'react'

interface MarkerClusterGroupProps extends LayerProps, L.MarkerClusterGroupOptions {
  children?: ReactNode
}

export const MarkerClusterGroup = createLayerComponent<L.MarkerClusterGroup, MarkerClusterGroupProps>(
  ({ children: _c, ...props }, ctx) => {
    const clusterProps: Record<string, any> = {}
    const clusterEvents: Record<string, any> = {}

    Object.entries(props).forEach(([propName, prop]) => {
      if (propName.startsWith('on')) {
        clusterEvents[propName] = prop
      } else {
        clusterProps[propName] = prop
      }
    })

    const instance = new L.MarkerClusterGroup(clusterProps)

    Object.entries(clusterEvents).forEach(([eventAsProp, callback]) => {
      const clusterEvent = `cluster${eventAsProp.substring(2).toLowerCase()}`
      instance.on(clusterEvent, callback)
    })

    return {
      instance,
      context: { ...ctx, layerContainer: instance },
    }
  },
  (instance, props, prevProps) => {
    // No-op for now unless we need dynamic prop updates
  }
)

