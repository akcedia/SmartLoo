# Nearby-search class model

Logical class view of the route and adapter in [PR #36](https://github.com/akcedia/SmartLoo/pull/36). `NearbySearchRoute` and `PostGISSearchAdapter` represent the functions `nearby()` and `find_nearby()`. `NearbyQuery`, `NearbyResponse`, and `FacilityResult` are interface shapes. The implemented functions exchange validated arguments and row dictionaries.

```mermaid
classDiagram
    class NearbySearchRoute {
        +nearby(query) NearbyResponse
    }
    class NearbyQuery {
        +float lat
        +float lon
        +float radius
        +bool open_now
        +bool has_disabled_access
        +bool has_baby_changing
        +bool is_free
    }
    class PostGISSearchAdapter {
        +find_nearby(query) FacilityResult[]
    }
    class NearbyResponse {
        +int count
        +FacilityResult[] results
    }
    class FacilityResult {
        +UUID id
        +string name
        +float latitude
        +float longitude
        +float distance_m
    }
    NearbySearchRoute ..> NearbyQuery : validates
    NearbySearchRoute ..> PostGISSearchAdapter : calls
    NearbySearchRoute ..> NearbyResponse : returns
    NearbyResponse "1" *-- "0..*" FacilityResult : contains
```

The radius is in metres. Optional amenity filters accept true, false or omission. Unknown stored amenity values match neither true nor false. `FacilityResult` shows the fields required for map placement and distance ordering. Available amenity metadata travels with the result.

[Back to the Software Design Report](../REPORT.md)
