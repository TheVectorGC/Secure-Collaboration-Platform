FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw mvnw
COPY pom.xml pom.xml
RUN chmod +x mvnw
RUN ./mvnw -B -DskipTests dependency:go-offline
COPY src src
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN addgroup --system vector && adduser --system --ingroup vector vector
COPY --from=build /workspace/target/*.jar /app/media-service.jar
RUN mkdir -p /var/lib/vector/media-files && chown -R vector:vector /app /var/lib/vector
USER vector
EXPOSE 8089
ENTRYPOINT ["java", "-jar", "/app/media-service.jar"]
